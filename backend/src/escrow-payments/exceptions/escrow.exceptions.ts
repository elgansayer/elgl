import { HttpException, HttpStatus } from '@nestjs/common';
import { EscrowErrorDetailsDto } from '../dto/escrow.dto';

export class EscrowBaseException extends HttpException {
  readonly escrowErrorCode: string;
  readonly isRecoverable: boolean;
  readonly errorContext?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    status: HttpStatus,
    isRecoverable: boolean,
    context?: Record<string, unknown>,
  ) {
    const response: Record<string, unknown> = {
      statusCode: status,
      errorCode: code,
      message,
    };
    if (context) {
      response.context = context;
    }

    super(response, status);
    this.escrowErrorCode = code;
    this.isRecoverable = isRecoverable;
    this.errorContext = context;
  }

  toErrorDetails(): EscrowErrorDetailsDto {
    return {
      code: this.escrowErrorCode,
      message: this.message,
      stack: this.stack,
      context: this.errorContext,
      isRecoverable: this.isRecoverable,
    };
  }
}

export class EscrowNotFoundException extends EscrowBaseException {
  constructor(escrowId: string) {
    super(
      'ESCROW_NOT_FOUND',
      `Escrow transaction ${escrowId} not found`,
      HttpStatus.NOT_FOUND,
      false,
      { escrowId },
    );
  }
}

export class EscrowInsufficientFundsException extends EscrowBaseException {
  constructor(userId: string, required: number, available: number) {
    super(
      'INSUFFICIENT_FUNDS',
      `User ${userId} has insufficient funds: required ${required}, available ${available}`,
      HttpStatus.PAYMENT_REQUIRED,
      true,
      { userId, required, available },
    );
  }
}

export class EscrowInvalidStateException extends EscrowBaseException {
  constructor(escrowId: string, currentState: string, expectedStates: string[]) {
    super(
      'INVALID_STATE',
      `Escrow ${escrowId} is in state "${currentState}", expected one of: ${expectedStates.join(', ')}`,
      HttpStatus.CONFLICT,
      true,
      { escrowId, currentState, expectedStates },
    );
  }
}

export class EscrowAlreadyDisputedException extends EscrowBaseException {
  constructor(escrowId: string) {
    super(
      'ALREADY_DISPUTED',
      `Escrow ${escrowId} is already under dispute`,
      HttpStatus.CONFLICT,
      true,
      { escrowId },
    );
  }
}

export class EscrowExpiredException extends EscrowBaseException {
  constructor(escrowId: string, expiredAt: string) {
    super(
      'ESCROW_EXPIRED',
      `Escrow ${escrowId} expired at ${expiredAt}`,
      HttpStatus.GONE,
      false,
      { escrowId, expiredAt },
    );
  }
}

export class EscrowPaymentGatewayException extends EscrowBaseException {
  constructor(
    gatewayMessage: string,
    context?: Record<string, unknown>,
  ) {
    super(
      'PAYMENT_GATEWAY_ERROR',
      `Payment gateway error: ${gatewayMessage}`,
      HttpStatus.BAD_GATEWAY,
      true,
      context,
    );
  }
}

export class EscrowUnauthorisedException extends EscrowBaseException {
  constructor(userId: string, escrowId: string) {
    super(
      'UNAUTHORISED_ESCROW_ACCESS',
      `User ${userId} is not authorised to access escrow ${escrowId}`,
      HttpStatus.FORBIDDEN,
      false,
      { userId, escrowId },
    );
  }
}