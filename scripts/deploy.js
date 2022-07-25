const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");

//Contract Address USD
const USD = readline.question("Enter the USD contract address: ");

//Addresses of MultiSignature owners
owners = [];

numbOwners = 0;
while(numbOwners < 3){
  if(numbOwners != 0) console.log("WARNING: The number of multisig users should not be less than 3!");
  numbOwners = readline.question("Enter the number of multisig owners: ");
}

for(i = 0; i < numbOwners; i++){
  owners[i] = readline.question("Enter the address of the "+ i+1 +" owner of the multisig: ");
}

const numb = readline.question("Enter the number of required confirmations for the multisig: ");

const rankOwner = readline.question("Enter the address of the owner of the ranks \n(Do not specify anything if you want the owner of the ranks was multisig): ");


async function RankDeploy(){
  const RANKS = await ethers.getContractFactory("Ranking");
  ranks = await RANKS.deploy();
  await ranks.deployed();
}

async function MSigDeploy(){
  const MSig = await ethers.getContractFactory("MultiSigWallet");
  msig = await MSig.deploy(owners, numb);
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

  if(rankOwner == ""){
    await ranks.connect(owner).transferOwnership(msig.address);
  }else{
    await ranks.connect(owner).transferOwnership(rankOwner);
  }

  console.log("ROP deployed to:", rop.address);
  console.log("MSig deployed to:", msig.address);
  console.log("Ranks deployed to:", ranks.address);
}

async function main(){
  owner = await ethers.getSigner();
  await deploy();
}

main();
