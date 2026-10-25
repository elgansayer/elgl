interface VisualContract {
  designSyncId: string;
  previewPath: string;
  states: string[];
}

interface ViewportContract {
  width: number;
  height: number;
}

interface VisualMatrix {
  rendering: {
    viewportMobile: ViewportContract;
    viewportTabletMd: ViewportContract;
    viewportTabletLgBoundary: ViewportContract;
    viewportWide: ViewportContract;
  };
  contracts: VisualContract[];
}

const mobileStates = {
  'mobile-390-light': { mode: 'light' },
  'mobile-390-dark': { mode: 'dark' },
  'mobile-390-rtl': { mode: 'rtl' },
  'mobile-390-text-200': { mode: 'text-200' },
  'mobile-390-text-400': { mode: 'text-400' },
} as const;

const tabletStates = {
  'tablet-768-light': { viewport: 'md', mode: 'light' },
  'tablet-768-dark': { viewport: 'md', mode: 'dark' },
  'tablet-768-rtl': { viewport: 'md', mode: 'rtl' },
  'tablet-768-text-200': { viewport: 'md', mode: 'text-200' },
  'tablet-1024-light': { viewport: 'lg', mode: 'light' },
  'tablet-1024-dark': { viewport: 'lg', mode: 'dark' },
} as const;

const desktopStates = {
  'desktop-1024-light': { viewport: 'lg', mode: 'light' },
  'desktop-1024-dark': { viewport: 'lg', mode: 'dark' },
  'desktop-1024-rtl': { viewport: 'lg', mode: 'rtl' },
  'desktop-1024-text-200': { viewport: 'lg', mode: 'text-200' },
  'desktop-1280-light': { viewport: 'wide', mode: 'light' },
  'desktop-1280-dark': { viewport: 'wide', mode: 'dark' },
} as const;

type VisualMode = 'light' | 'dark' | 'rtl' | 'text-200' | 'text-400';
type MobileState = keyof typeof mobileStates;
type TabletState = keyof typeof tabletStates;
type DesktopState = keyof typeof desktopStates;

const automatedStates = new Set([
  'light',
  'dark',
  '390px',
  'wide',
  'rtl',
  ...Object.keys(mobileStates),
  ...Object.keys(tabletStates),
  ...Object.keys(desktopStates),
]);

function isMobileState(state: string): state is MobileState {
  return state in mobileStates;
}

function isTabletState(state: string): state is TabletState {
  return state in tabletStates;
}

function isDesktopState(state: string): state is DesktopState {
  return state in desktopStates;
}

function applyState(state: string, rendering: VisualMatrix['rendering']): void {
  let viewport: ViewportContract | undefined;
  let mode: VisualMode = 'light';

  if (isMobileState(state)) {
    viewport = rendering.viewportMobile;
    mode = mobileStates[state].mode;
  } else if (state === '390px') {
    viewport = rendering.viewportMobile;
  } else if (state === 'wide') {
    viewport = rendering.viewportWide;
  } else if (isTabletState(state)) {
    const tabletState = tabletStates[state];
    viewport =
      tabletState.viewport === 'md'
        ? rendering.viewportTabletMd
        : rendering.viewportTabletLgBoundary;
    mode = tabletState.mode;
  } else if (isDesktopState(state)) {
    const desktopState = desktopStates[state];
    viewport =
      desktopState.viewport === 'lg'
        ? rendering.viewportTabletLgBoundary
        : rendering.viewportWide;
    mode = desktopState.mode;
  } else if (state === 'dark') {
    mode = 'dark';
  } else if (state === 'rtl') {
    mode = 'rtl';
  }

  if (viewport) {
    cy.viewport(viewport.width, viewport.height);
  }

  cy.document().then((document) => {
    document.documentElement.classList.remove('dark');
    document.documentElement.dir = 'ltr';
    document.documentElement.style.scrollBehavior = 'auto';
    document.documentElement.style.fontSize = '';

    document.querySelectorAll('style[data-visual-contract="true"]').forEach((style) => style.remove());

    const style = document.createElement('style');
    style.dataset['visualContract'] = 'true';
    style.textContent = `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        caret-color: transparent !important;
      }
    `;
    document.head.appendChild(style);

    if (mode === 'dark') document.documentElement.classList.add('dark');
    if (mode === 'rtl') document.documentElement.dir = 'rtl';
    if (mode === 'text-200') document.documentElement.style.fontSize = '200%';
    if (mode === 'text-400') document.documentElement.style.fontSize = '400%';
  });
}

function assertNoHorizontalDocumentOverflow(state: string, context: string): void {
  cy.window().then((window) => {
    const root = window.document.documentElement;
    expect(
      root.scrollWidth,
      `${state}: ${context} must not create horizontal document overflow`,
    ).to.be.at.most(window.innerWidth + 1);
  });
}

function assertTextScale(state: string, root: HTMLElement, mode: VisualMode): void {
  const rootFontSize = Number.parseFloat(getComputedStyle(root).fontSize);
  if (mode === 'text-200') {
    expect(rootFontSize, `${state}: 200% text-scale state must enlarge root text`).to.be.greaterThan(
      16,
    );
  }
  if (mode === 'text-400') {
    expect(
      rootFontSize,
      `${state}: 400% text-scale state must substantially enlarge root text`,
    ).to.be.greaterThan(32);
  }
}

function assertMobileResponsiveContract(state: string): void {
  if (!isMobileState(state)) return;

  cy.window().its('innerWidth').should('eq', 390);
  assertNoHorizontalDocumentOverflow(state, '390px mobile layout');

  cy.document().then((document) => {
    const root = document.documentElement;
    const mode = mobileStates[state].mode;
    if (mode === 'dark') {
      expect(root.classList.contains('dark'), `${state}: dark state must apply dark theme`).to.equal(
        true,
      );
    }
    if (mode === 'light') {
      expect(
        root.classList.contains('dark'),
        `${state}: light state must not retain dark theme`,
      ).to.equal(false);
    }
    if (mode === 'rtl') {
      expect(root.dir, `${state}: RTL state must preserve document direction`).to.equal('rtl');
    }
    assertTextScale(state, root, mode);
  });
}

function assertResponsiveContract(state: string): void {
  const responsiveState = isTabletState(state)
    ? { family: 'tablet', ...tabletStates[state] }
    : isDesktopState(state)
      ? { family: 'desktop', ...desktopStates[state] }
      : undefined;
  if (!responsiveState) return;

  if (responsiveState.family === 'tablet') {
    assertNoHorizontalDocumentOverflow(state, 'tablet layout');
  } else {
    assertNoHorizontalDocumentOverflow(state, 'desktop layout');
  }

  cy.document().then((document) => {
    const root = document.documentElement;
    if (responsiveState.mode === 'rtl') {
      expect(root.dir, `${state}: RTL state must preserve document direction`).to.equal('rtl');
    }
    assertTextScale(state, root, responsiveState.mode);
  });
}

describe('Relay + Spartan visual contracts', () => {
  before(() => {
    Cypress.Screenshot.defaults({
      capture: 'fullPage',
      disableTimersAndAnimations: true,
      scale: false,
    });
  });

  it('captures deterministic repository-owned preview states', () => {
    cy.readFile<VisualMatrix>('../visual-contract.matrix.json').then((matrix) => {
      for (const contract of matrix.contracts) {
        for (const state of contract.states) {
          if (!automatedStates.has(state)) continue;

          const url = `/${contract.previewPath}`;
          cy.visit(url);
          cy.get('body').should('be.visible');
          applyState(state, matrix.rendering);
          cy.document().its('fonts.status').should('eq', 'loaded');
          assertMobileResponsiveContract(state);
          assertResponsiveContract(state);
          cy.screenshot(`${contract.designSyncId}/${state}`, { capture: 'fullPage' });
        }
      }
    });
  });
});
