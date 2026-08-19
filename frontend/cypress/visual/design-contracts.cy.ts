interface VisualContract {
  designSyncId: string;
  previewPath: string;
  states: string[];
}

interface VisualMatrix {
  contracts: VisualContract[];
}

const automatedStates = new Set(['light', 'dark', '390px', 'wide', 'rtl']);

function applyState(state: string): void {
  if (state === '390px') {
    cy.viewport(390, 844);
    return;
  }
  if (state === 'wide') {
    cy.viewport(1280, 900);
    return;
  }

  cy.document().then((document) => {
    document.documentElement.classList.remove('dark');
    document.documentElement.dir = 'ltr';
    document.documentElement.style.scrollBehavior = 'auto';

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

    if (state === 'dark') document.documentElement.classList.add('dark');
    if (state === 'rtl') document.documentElement.dir = 'rtl';
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
          applyState(state);
          cy.document().its('fonts.status').should('eq', 'loaded');
          cy.screenshot(`${contract.designSyncId}/${state}`, { capture: 'fullPage' });
        }
      }
    });
  });
});
