const experimentStrategies = [
  {
    period: 12,
    platform: 'plugin',
    priceTag: 'TEST_Plugin_Price_7799',
    experiments: ['TEST_Plugin_Raisepackage_Test'],
  },
];

const getDiscountCode = (tag) => {
  switch (tag) {
    case 'discount_10_off':
      return 'Discount10';
    case 'discount_5_usd':
      return 'Discount5USD';
    case 'discount_6_usd':
      return 'Discount6USD';
    case 'discount_4_usd':
      return 'Discount4USD';
    default:
      return '';
  }
};
module.exports = {
  experimentStrategies,
  getDiscountCode,
};
