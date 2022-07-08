const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");

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

async function deploy() {
  const ROP = await ethers.getContractFactory("RootOfPools_v013");

  await RankDeploy();

  rop = await upgrades.deployProxy(ROP, [USD, ranks.address], {
    initializer: "initialize",
  });

  await rop.deployed();

  console.log("ROP deployed to:", rop.address);
  console.log("Ranks deployed to:", ranks.address);
}

async function main(){
  owner = await ethers.getSigner();
  await deploy();
  f123();
}

async function deployDaughter(Name){
    BOP = await ethers.getContractFactory("BranchOfPools");
    bop = await BOP.deploy(rop.address, 1000, 1000, 1000, "0xb2b009Fe33c8EcE7AC9a1BbE9C438A0795A7dC9b", "0xb2b009Fe33c8EcE7AC9a1BbE9C438A0795A7dC9b");
    
    await bop.connect(owner).transferOwnership(rop.address);

    await rop.connect(owner).createPool(Name, bop.address);
}

//TODO 
async function f123() {
    let len = 800;

    let wallets = [];
    let amounts = [];
    let FR = 100 * len;
    let CC = FR * 0.2;
    for(i = 0; i < len; i++){
        wallets.push(ethers.Wallet.createRandom().address);
        amounts.push(100);
    }
    await deployDaughter("123");

    
    tx = await rop.connect(owner).dataImport("123", FR, CC, wallets, amounts);
    console.log(tx);
}

main();
