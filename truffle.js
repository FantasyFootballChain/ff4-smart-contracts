const HDWalletProvider = require("truffle-hdwallet-provider");

const env = require('./env.js');

module.exports = {
	networks: {
		development: {
			host: "localhost",
			port: 8555,
			network_id: "*",
			gas: 10000000
		},
		main: {
			provider: () => new HDWalletProvider(env.MNEMONIC, `https://mainnet.infura.io/v3/${env.INFURA_API_KEY}`),
			network_id: 1
		},
		ropsten: {
			provider: () => new HDWalletProvider(env.MNEMONIC, `https://ropsten.infura.io/v3/${INFURA_API_KEY}`),
			network_id: 3
		},
		kovan: {
			provider: () => new HDWalletProvider(env.MNEMONIC, `https://kovan.infura.io/v3/${env.INFURA_API_KEY}`),
			network_id: 42
		},
		rinkeby: {
			provider: () => new HDWalletProvider(env.MNEMONIC, `https://rinkeby.infura.io/v3/${env.INFURA_API_KEY}`),
			network_id: 4
		}
	}
};
