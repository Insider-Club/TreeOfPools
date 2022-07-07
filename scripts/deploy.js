const { ethers, upgrades } = require("hardhat");

//Contract Address USD
const USD = "0x78867BbEeF44f2326bF8DDd1941a4439382EF2A7";

//Addresses of MultiSignature owners
const addr1 = "0x26e41CAc0524AaA4D3E1279EfE2FEE49eeDe4709";
const addr2 = "0x889bb9292f93Af7B19136dc2D8Dca1c0951F5675";
const addr3 = "0xCcC62370E3a2e3Cd0958dc2B0a49e552a5c727b6";


async function RankDeploy(){
  const RANKS = await ethers.getContractFactory("Ranking");
  ranks = await RANKS.deploy();
  await ranks.deployed();
}

async function MSigDeploy(){
  const MSig = await ethers.getContractFactory("MultiSigWallet");
  msig = await MSig.deploy([addr1, addr2, addr3], 2);
  await msig.deployed();
}

async function deploy() {
  const ROP = await ethers.getContractFactory("RootOfPools_v013");

  await RankDeploy();

  await MSigDeploy();

  const rop = await upgrades.deployProxy(ROP, [USD, ranks.address], {
    initializer: "initialize",
  });

  await rop.deployed();
  await rop.connect(owner).transferOwnership(msig.address);

  console.log("ROP deployed to:", rop.address);
}

async function main(){
  owner = await ethers.getSigner();
  await deploy();
}

main();
