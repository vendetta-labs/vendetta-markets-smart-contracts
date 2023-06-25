import { ethers } from "hardhat";

async function main() {
  console.log("Creating wallet...");
  const wallet = ethers.Wallet.createRandom();
  console.log("Wallet created!");
  console.log("Address: ", wallet.address);
  console.log("Private key: ", wallet.privateKey);
  console.log("Mnemonic: ", wallet.mnemonic?.phrase);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
