require("@nomicfoundation/hardhat-toolbox");
require('@openzeppelin/hardhat-upgrades');
require('@nomicfoundation/hardhat-foundry');
require('hardhat-gas-reporter');
require('dotenv').config();


const accounts = {
  mnemonic: process.env.MNEMONIC || (() => {
    throw new Error("Please set MNEMONIC environment variable");
  })(),
};

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  gasReporter: {
    enabled: true
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
    alice: {
      default: 1,
    },
    bob: {
      default: 2,
    },
    carol: {
      default: 3,
    },
  },
  networks: {
    polygon: {
      url: "https://polygon-mainnet.infura.io/v3/76a2e551f88444f1b7e8caf334a2a0e1",
      chainId: 137,
      accounts,      
      saveDeployments: true,
      live: true,
    },
    mainnet: {
      url: process.env.ETHEREUM_RPC_URL || `https://mainnet.infura.io/v3/76a2e551f88444f1b7e8caf334a2a0e1`,
      accounts,
      chainId: 1,
      saveDeployments: true,
      live: true,
      tags: ["prod"],
    }
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_TOKEN,
      sepolia: "",
      avalanche: process.env.ETHERSCAN_TOKEN
    },
  },
  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: true
  },
  solidity: {
    compilers: [
      {
        version: "0.6.2",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      },
      {
        version: "0.4.16",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
      {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 100000,
          },
        },
      }
    ],
  },
};
