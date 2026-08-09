const JSDOM = jest.fn().mockImplementation(() => ({
  window: {
    document: {
      createElement: jest.fn(),
      createDocumentFragment: jest.fn(),
    },
    Node: {
      ELEMENT_NODE: 1,
      TEXT_NODE: 3,
      DOCUMENT_FRAGMENT_NODE: 11,
    },
    NodeFilter: {
      SHOW_ELEMENT: 1,
      SHOW_TEXT: 4,
    },
  },
}));

module.exports = { JSDOM };