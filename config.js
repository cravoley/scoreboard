var mkpath = require('mkpath');

var env = process.env.NODE_ENV;
var config;
if (env === 'development') {
	config = require("./config.json");
} else
	config = require("./config_" + env + ".json");

if (!config.cacheDir) config.cacheDir = "./cache/";
if (config.cacheDir.lastIndexOf("/") != (config.cacheDir.length - 1)) config.cacheDir = config.cacheDir + "/";
if (config.contentHub.changes.lastIndexOf("/") != (config.contentHub.changes.length - 1)) config.contentHub.changes = config.contentHub.changes + "/";
if (config.contentHub.content.lastIndexOf("/") != (config.contentHub.content.length - 1)) config.contentHub.content = config.contentHub.content + "/";
if (!config.username) config.username = "sysadmin";
if (!config.password) config.password = "sysadmin";

mkpath.sync(config.cacheDir);

module.exports = config;