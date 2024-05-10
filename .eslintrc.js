module.exports = {
  'env': {
    'browser': true,
    'es2023': true,
  },
  'extends': 'google',
  'overrides': [
    {
      'env': {
        'node': true,
      },
      'files': [
        '.eslintrc.{js,cjs}',
      ],
      'parserOptions': {
        'sourceType': 'script',
      },
    },
  ],
  'parserOptions': {
    'ecmaVersion': 'latest',
    'sourceType': 'module',
  },
  'rules': {
    'jsdoc/no-undefined-types': [
      1,
      {
        'definedTypes': [
          'chrome', 'RequestInit',
        ],
      },
    ],
    'max-len': 'off',
    'require-jsdoc': 'error',
  },
  'plugins': [
    'jsdoc',
  ],
};
