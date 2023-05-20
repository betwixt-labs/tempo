const HtmlWebpackPlugin = require('html-webpack-plugin');
const path = require('path');

module.exports = {
  entry: './browser/index.tsx',
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
    fallback: { "util": false }
  },
  output: {
    path: path.join(__dirname, '/dist'),
    filename: 'bundle.js',
  },
  experiments: {
    topLevelAwait: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './browser/index.html',
    }),
  ],
};