"use strict";

module.exports = {
  devtool: "inline-source-map",
  entry: "./src/index.ts",
  output: { filename: "dist/index.js" },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        loader: ["ts-loader", "ts-react-loader"]
      }
    ]
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"]
  }
};
