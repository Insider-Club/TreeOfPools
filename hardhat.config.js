require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-ethers");
require("@openzeppelin/hardhat-upgrades");
require("@nomiclabs/hardhat-etherscan");
const { PK, TBSC_API_KEY } = require("./env.json");

module.exports = {
  solidity: {
    compilers: [
      {
        version: "0.8.15",
      },
      {
        version: "0.5.16",
      },
      {
        version: "0.4.16",
      },
    ],
  },
  networks: {
    testbsc: {
      url: `https://data-seed-prebsc-1-s3.binance.org:8545`,
      accounts: [PK],
      gas: 21000000,
    },
  },
  etherscan: {
    apiKey: TBSC_API_KEY,
  },
};
