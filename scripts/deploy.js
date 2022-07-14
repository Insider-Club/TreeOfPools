const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");

//Contract Address USD
const USD = readline.question("Enter the USD contract address: ");

//Addresses of MultiSignature owners
const addr1 = readline.question("Enter the address of the 1st owner of the multisig: ");
const addr2 = readline.question("Enter the address of the second owner of the multisig: ");
const addr3 = readline.question("Enter the address of the 3rd owner of the multisig: ");


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
  console.log("MSig deployed to:", msig.address);
  console.log("Ranks deployed to:", ranks.address);
}

async function main(){
  owner = await ethers.getSigner();
  await deploy();
}

main();
