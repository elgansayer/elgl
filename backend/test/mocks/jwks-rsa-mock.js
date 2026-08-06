const jwksClient = jest.fn().mockImplementation(() => ({
  getSigningKey: jest.fn().mockResolvedValue({
    getPublicKey: jest.fn().mockReturnValue('mock-public-key'),
  }),
}));

module.exports = jwksClient;
module.exports.default = jwksClient;
