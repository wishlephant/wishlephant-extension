type ParseResult = {
  name: string;
  image: string;
  price: string;
  priceCurrency: string;
  isbn: string;
};

const parse = (input: string): ParseResult => {
  console.log('input', input);
  return {
    name: 'Hello',
    image: 'http://example.com/imgae',
    price: '213',
    priceCurrency: 'USD',
    isbn: '1234567890',
  };
};

export default parse;
