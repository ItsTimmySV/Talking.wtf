const path = require('path');
const Dotenv = require('dotenv-webpack');

module.exports = {
    entry: './app.js',
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /node_modules/,
                use: {
                    loader: 'babel-loader',
                },
            },
        ],
    },
    plugins: [
        new Dotenv()
    ],
    mode: 'development',
    resolve: {
        fallback: {
            "chart.js": require.resolve("chart.js")
        }
    }
};