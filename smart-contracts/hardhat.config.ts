import { HardhatUserConfig, task } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import dotenv from "dotenv";
dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("account", "Prints the info of account", async (taskArgs, hre) => {
  const account = await hre.ethers.Wallet.fromPhrase(
    process.env.MNEMONIC || ""
  ).connect(hre.ethers.provider);

  console.log("Account: ", account.address);
  const balance = await hre.ethers.provider.getBalance(account.address);
  console.log("Network: ", hre.network.name);
  console.log("Balance: ", hre.ethers.formatEther(balance), "ETH");
});

const optimismGoerliUrl = process.env.ALCHEMY_API_KEY
  ? `https://opt-goerli.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
  : process.env.OPTIMISM_GOERLI_URL;

const mnemonic = process.env.MNEMONIC;
if (!mnemonic) {
  console.log("You need to set a mnemonic in the .env file");
  process.exit(-1);
}

const words = (mnemonic || "").match(/[a-zA-Z]+/g)?.length || 0;
const validLength = [12, 15, 18, 24];
if (!validLength.includes(words)) {
  console.log(
    `The mnemonic (${process.env.MNEMONIC}) is the wrong number of words`
  );
  process.exit(-1);
}

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more
const config: HardhatUserConfig = {
  solidity: "0.8.18",
  networks: {
    local: {
      url: "http://localhost:9545",
      accounts: {
        mnemonic: "test test test test test test test test test test test junk",
      },
    },
    "op-goerli": {
      url: optimismGoerliUrl,
      accounts: { mnemonic: process.env.MNEMONIC },
    },
  },
};

export default config;
