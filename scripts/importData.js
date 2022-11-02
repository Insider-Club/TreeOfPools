const { ERC1820Registry } = require("@openzeppelin/test-helpers/src/singletons");
const { ethers, upgrades } = require("hardhat");
const readline = require("readline-sync");
const ROPArtifacts = require("../artifacts/contracts/ROP.sol/RootOfPools_v2.json");
const BOPArtifacts = require("../artifacts/contracts/BOP.sol/BranchOfPools.json");
const {FR, CC, users, values} = require("../usersData.json");


const STEP = 100;
const BRANCH = "0xC08caB35Fc23C017f40a82d960C96FE83a2cf5F9";

async function main(){
  [owner, other] = await ethers.getSigners();
  const ROP = readline.question("Enter the ROP address: ");
  namePool = readline.question("Enter the name pool: ");
  rop = new ethers.Contract(ROP, ROPArtifacts.abi, ethers.provider);
  branch = new ethers.Contract(BRANCH, BOPArtifacts.abi, ethers.provider);

  await importData();
}

//TODO Make a normal export and import of data
async function importData() {
    if(users.length != values.length){
      console.log("Error: Users.len != Values.len");
      return;
    }

    for(i = 0; i < users.length; i++){
      users[i] = ethers.utils.getAddress(users[i]);
      values[i] = Number(values[i]);
    }
    //tx = await rop.connect(owner).dataImport(namePool, FR, CC, users, values);

    tx1 = await branch.populateTransaction.importFR(FR);
    tx2 = await root.populateTransaction.Calling(namePool, tx1.data);
    await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
    id = (await msig.transactionCount()) - 1;
    await msig.connect(other).confirmTransaction(id);
    console.log("Import FR - ",tx2);

    tx1 = await branch.populateTransaction.importCC(CC);
    tx2 = await root.populateTransaction.Calling(namePool, tx1.data);
    tx = await msig.connect(owner).submitTransaction(root.address, 0, tx2.data);
    id = (await msig.transactionCount()) - 1;
    await msig.connect(other).confirmTransaction(id);
    console.log("Import CC - ",tx2);

    tx1 = await branch.populateTransaction.importFR(FR);
    tx2 = await rop.connect(owner).Calling("Test", tx1.data);

    tx1 = await branch.populateTransaction.importCC(CC);
    tx2 = await rop.connect(owner).Calling("Test", tx1.data);

    for(i = 0; i < users.length; i += STEP){
      uTemp = users.slice(i, i + STEP);
      vTemp = values.slice(i, i + STEP);
      console.log("Sending ", i, " - ", i + vTemp.length);

      tx1 = await branch.populateTransaction.importTable(uTemp, uTemp);
      tx2 = await rop.connect(owner).Calling("Test", tx1.data, {gasLimit: 9000000});

      console.log("Done! - ", tx2.hash, "\n");
    }
}

main();
