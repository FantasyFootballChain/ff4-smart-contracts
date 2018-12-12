const env = require("../env.js");

const FantasyFootballChain = artifacts.require("./FantasyFootballChain.sol");

module.exports = (deployer) => {
	deployer.deploy(FantasyFootballChain, env.ORACLE_ADDRESS, env.PLATFORM_FEE_ADDRESS, env.PLATFORM_FEE_RATE);
};
