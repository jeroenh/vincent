const path = require('path');
var BundleTracker = require('webpack-bundle-tracker');
var MiniCssExtractPlugin = require('mini-css-extract-plugin');
var Dotenv = require('dotenv-webpack');

const ASSET_PATH = process.env.ASSET_PATH || 'http://localhost:3000/dist/';

module.exports = {
    mode: 'development',
    context: __dirname,
    entry: {
	login: './assets/js/login',
	app: './assets/js/app',
	//triageapp: './assets/js/triage',
	//dashboardapp: './assets/js/dashboard',
	//componentapp: './assets/js/component',
	//searchcases: './assets/js/case',
	//searchall: './assets/js/search',
	vincent: '/assets/js/vincent',
	//inbox: './assets/js/inbox',
	custom_form: './assets/js/custom_form',
	//groups: './assets/js/groups',
	//myreports: './assets/js/myreports',
	//sysadmin: './assets/js/sysadmin',
	/* below were combined with above apps */
	//reportapp: './assets/js/report',
	//admin: './assets/js/admin',
	//cvdp: './assets/js/cvdp',
	//cve: './assets/js/cve',
	//groupadmin: './assets/js/groupadmin',
	//contactapp: './assets/js/contact',
    },

    output: {
	path: path.resolve('./assets/webpack_bundles/'),
	filename: "[name]-[hash].js",
	chunkFilename: "[name]-[hash].js",
        // points to a webpack-dev-server (WDS), configured below
        // it is important that the url points to a WDS, not Django
        // I would use the same prefix you'd use in STATIC_URL,
        // in my case it is "/static/", but it is not really important
        publicPath: ASSET_PATH
    },
    // build the source maps to make debugging make more sense
    devtool: 'inline-source-map',
    /*optimization: {
	runtimeChunk: "single",
    },*/
    devServer: {
        // for assets not handled by webpack
        // port should be different from the one you use to run Django
        port: 3000,
        headers: {
          'Access-Control-Allow-Origin': '*'
        },
	// don't show a full screen overlay  on warnings and runtimeErrors
	client: {
	    overlay: {
		errors: true,
		warnings: false,
		runtimeErrors: false,
	    },
	},
        // gzip everything served by dev server, could speed things up a bit
        compress: true,
        // HMR
        hot: true
    },
    plugins: [
	new BundleTracker({
		path: path.resolve("./"),
		filename: 'webpack-stats.json'
	}),
	new MiniCssExtractPlugin({
	    filename: '[name]-[hash].css',
	    chunkFilename: '[name]-[hash].css',
	}),
	new Dotenv({
            systemvars: true, // load system envvars
	})
    ],
    /*

    entry: './assets/index.js',  // path to our input file
    output: {
	filename: 'index-bundle.js',  // output bundle file name
	path: path.resolve(__dirname, './static'),  // path to our Django static directory
	},*/
    
    module: {
	rules: [
	    {
		test: /\.(js|jsx)$/,
		exclude: /node_modules/,
		loader: "babel-loader",
		options: { presets: ["@babel/preset-env", "@babel/preset-react"] }
	    },
	     {
		 test: /\.css$/,
		 use: [MiniCssExtractPlugin.loader, 'css-loader'],
	     },
	    
	]
    },
    
    resolve: {
	alias: {
	    Components: path.resolve(__dirname, 'assets/js/'),
	    Styles: path.resolve(__dirname, 'assets/css/')	    
	},
	modules: ['node_modules'],
	extensions: ['.js', '.jsx',]
    },

	cache: {
		type: 'filesystem',
		cacheDirectory: path.resolve(__dirname, '.webpack_cache'),
	},
    
};


