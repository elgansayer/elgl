import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DmcaCounterNoticeRow,
  DmcaNoticeEventRow,
  DmcaNoticeRow,
  SupabaseService,
} from '../supabase/supabase.service';
import {
  DMCA_PAGE_SIZE_DEFAULT,
  DMCA_RESTORABLE_STATUSES,
  DmcaNoticeStatus,
  DmcaTargetType,
} from './dmca.constants';
import { DmcaService, DmcaTarget } from './dmca.service';
import {
  AdminDmcaDecisionDto,
  AdminDmcaListQueryDto,
} from './dto/admin-dmca.dto';

export interface OperatorNoticeSummary {
  id: string;
  reference: string;
  status: DmcaNoticeStatus;
  claimantName: string;
  claimantOrganisation: string | null;
  targetType: DmcaTargetType | null;
  targetId: string | null;
  targetOwnerId: string | null;
  contentDisabledAt: string | null;
  counterNoticeAt: string | null;
  restoreAfter: string | null;
  closedAt: string | null;
  createdAt: string;
}

export interface OperatorNoticeDetail extends OperatorNoticeSummary {
  claimantEmail: string;
  claimantAddress: string | null;
  claimantPhone: string | null;
  copyrightedWork: string;
  materialReference: string;
  electronicSignature: string;
  verifiedAt: string | null;
  events: Array<{ event: string; actorType: string; createdAt: string }>;
  counterNotice: {
    fullName: string;
    address: string;
    phone: string | null;
    createdAt: string;
  } | null;
}

export interface OperatorNoticeList {
  items: OperatorNoticeSummary[];
  page: number;
  pageSize: number;
  total: number;
}

const SUMMARY_COLUMNS =
  'id, reference, status, claimant_name, claimant_organisation, target_type, target_id, target_owner_id, content_disabled_at, counter_notice_at, restore_after, closed_at, created_at';

@Injectable()
export class DmcaOperatorService {
  private readonly logger = new Logger(DmcaOperatorService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly dmcaService: DmcaService,
  ) {}

  async list(query: AdminDmcaListQueryDto): Promise<OperatorNoticeList> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DMCA_PAGE_SIZE_DEFAULT;
    const from = (page - 1) * pageSize;

    let request = this.supabaseService
      .getClient()
      .from('dmca_notices')
      .select(SUMMARY_COLUMNS, { count: 'exact' });
    if (query.status) request = request.eq('status', query.status);

    const { data, count, error } = await request
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) {
      this.logger.error('dmca_operator_list_failed');
      throw new ServiceUnavailableException('Unable to load notices');
    }

    return {
      items: (data ?? []).map((row) => this.toSummary(row)),
      page,
      pageSize,
      total: count ?? 0,
    };
  }

  async get(noticeId: string): Promise<OperatorNoticeDetail> {
    const notice = await this.dmcaService.findNotice(noticeId);
    if (!notice) throw new NotFoundException('Notice not found');

    const client = this.supabaseService.getClient();
    const [events, counter] = await Promise.all([
      client
        .from('dmca_notice_events')
        .select('event, actor_type, created_at')
        .eq('notice_id', noticeId)
        .order('created_at', { ascending: true })
        .limit(200),
      client
        .from('dmca_counter_notices')
        .select('full_name, address, phone, created_at')
        .eq('notice_id', noticeId)
        .maybeSingle(),
    ]);
    if (events.error || counter.error) {
      this.logger.error('dmca_operator_detail_failed');
      throw new ServiceUnavailableException('Unable to load the notice');
    }

    return {
      ...this.toSummary(notice),
      claimantEmail: notice.claimant_email,
      claimantAddress: notice.claimant_address,
      claimantPhone: notice.claimant_phone,
      copyrightedWork: notice.copyrighted_work,
      materialReference: notice.material_reference,
      electronicSignature: notice.electronic_signature,
      verifiedAt: notice.verified_at,
      events: (events.data ?? []).map((event) => this.toEvent(event)),
      counterNotice: counter.data ? this.toCounter(counter.data) : null,
    };
  }

  /**
   * Applies an operator decision. Every branch is a compare-and-set on the
   * notice status, so two operators acting at once cannot both succeed.
   */
  async decide(
    noticeId: string,
    operatorId: string,
    dto: AdminDmcaDecisionDto,
    now: Date = new Date(),
  ): Promise<OperatorNoticeDetail> {
    const notice = await this.dmcaService.findNotice(noticeId);
    if (!notice) throw new NotFoundException('Notice not found');
    const actor = { type: 'operator' as const, id: operatorId };

    switch (dto.decision) {
      case 'disable': {
        if (notice.status !== 'needs_review') {
          throw new ConflictException(
            'Only notices awaiting review can be disabled',
          );
        }
        const target = await this.targetFor(notice, dto);
        const disabled = await this.dmcaService.disableNotice(
          notice,
          target,
          actor,
          now,
        );
        if (!disabled)
          throw new ConflictException('The notice could not be applied');
        break;
      }
      case 'reject':
      case 'withdraw': {
        const closed = await this.dmcaService.closeNotice(
          notice,
          dto.decision === 'reject' ? 'rejected' : 'withdrawn',
          DMCA_RESTORABLE_STATUSES,
          actor,
          now,
        );
        if (!closed)
          throw new ConflictException('The notice could not be closed');
        break;
      }
      case 'litigation_hold': {
        const held = await this.dmcaService.holdForLitigation(
          notice,
          actor,
          now,
        );
        if (!held)
          throw new ConflictException('The notice cannot be placed on hold');
        break;
      }
    }

    return this.get(noticeId);
  }

  /** The notice's own target, or the one the operator names after confirming it exists. */
  private async targetFor(
    notice: DmcaNoticeRow,
    dto: AdminDmcaDecisionDto,
  ): Promise<DmcaTarget> {
    const type = notice.target_type ?? dto.targetType;
    const id = notice.target_id ?? dto.targetId;
    if (!type || !id) {
      throw new BadRequestException('targetType and targetId are required');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from(type === 'moment' ? 'moments' : 'moment_comments')
      .select('user_id')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new ServiceUnavailableException('Unable to look up the material');
    }
    if (!data?.user_id) throw new NotFoundException('Material not found');
    return { type, id, ownerId: data.user_id };
  }

  private toSummary(
    row: Pick<
      DmcaNoticeRow,
      | 'id'
      | 'reference'
      | 'status'
      | 'claimant_name'
      | 'claimant_organisation'
      | 'target_type'
      | 'target_id'
      | 'target_owner_id'
      | 'content_disabled_at'
      | 'counter_notice_at'
      | 'restore_after'
      | 'closed_at'
      | 'created_at'
    >,
  ): OperatorNoticeSummary {
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      claimantName: row.claimant_name,
      claimantOrganisation: row.claimant_organisation,
      targetType: row.target_type,
      targetId: row.target_id,
      targetOwnerId: row.target_owner_id,
      contentDisabledAt: row.content_disabled_at,
      counterNoticeAt: row.counter_notice_at,
      restoreAfter: row.restore_after,
      closedAt: row.closed_at,
      createdAt: row.created_at,
    };
  }

  private toEvent(
    row: Pick<DmcaNoticeEventRow, 'event' | 'actor_type' | 'created_at'>,
  ): OperatorNoticeDetail['events'][number] {
    return {
      event: row.event,
      actorType: row.actor_type,
      createdAt: row.created_at,
    };
  }

  private toCounter(
    row: Pick<
      DmcaCounterNoticeRow,
      'full_name' | 'address' | 'phone' | 'created_at'
    >,
  ): NonNullable<OperatorNoticeDetail['counterNotice']> {
    return {
      fullName: row.full_name,
      address: row.address,
      phone: row.phone,
      createdAt: row.created_at,
    };
  }
}
