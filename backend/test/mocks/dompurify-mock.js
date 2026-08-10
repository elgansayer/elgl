const mockSanitize = (dirty) => {
  if (typeof dirty !== 'string') return dirty;
  let result = dirty
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '');
  result = result.replace(/<[^>]*>/g, '');
  result = result
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'");
  return result;
};

const DOMPurify = () => ({
  sanitize: mockSanitize,
  setConfig: jest.fn(),
});

module.exports = DOMPurify;
module.exports.default = DOMPurify;
