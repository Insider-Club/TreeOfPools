const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");
const ROPArtifacts = require("../artifacts/contracts/ROP.sol/RootOfPools_v013.json");
const {FR, CC, users, values} = require("../usersData.json");

async function main(){
  owner = await ethers.getSigner();
  const ROP = readline.question("Enter the ROP address: ");
  namePool = readline.question("Enter the name pool: ");
  rop = ethers.Contract(ROP, ROPArtifacts.abi, provider);

  await importData();
}

//TODO Make a normal export and import of data
async function importData() {
    tx = await rop.connect(owner).dataImport(namePool, FR, CC, users, values);
    console.log(tx);
}

main();
