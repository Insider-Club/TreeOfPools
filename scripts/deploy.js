const { ethers, upgrades } = require("hardhat");

const BUSD = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7";
const RANK = "0xb4c285BBFc1D36bE03292575010346D8D0b2a9c7";
const MSIG = "0x9F77030b518aA569391301C28aA578492c49B621";
const adr1 = "0x26e41CAc0524AaA4D3E1279EfE2FEE49eeDe4709";
const adr2 = "0x889bb9292f93Af7B19136dc2D8Dca1c0951F5675";
const adr3 = "0xCcC62370E3a2e3Cd0958dc2B0a49e552a5c727b6";
const adrRank = "0x05978E55cc90DabD84FB5c8859b50Ad1e78F5411";

async function main() {
  const RANKS = await ethers.getContractFactory("Ranking");
  const ROP = await ethers.getContractFactory("RootOfPools_v013");
  const BOP = await ethers.getContractFactory("BranchOfPools");
  const owner = await ethers.getSigner();

  /*const ranks = await RANKS.deploy();
  await ranks.deployed();

  await ranks.connect(owner).transferOwnership(adrRank);*/

  /*MSig = await ethers.getContractFactory("MultiSigWallet");
  msig = await MSig.deploy([adr1, adr2, adr3], 2);
  await msig.deployed();*/

  const rop = await upgrades.deployProxy(ROP, [BUSD, RANK], {
    initializer: "initialize",
  });

  await rop.deployed();
  await rop.connect(owner).transferOwnership(MSIG);

  console.log("ROP deployed to:", rop.address);
}

main();
