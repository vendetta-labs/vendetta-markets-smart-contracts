import hre from "hardhat";

async function main() {
  console.log("Network: ", hre.network.name);

  // const testnetUSDC = "0x7E07E15D2a87A24492740D16f5bdF58c16db0c4E";
  // const GameMarket = await hre.ethers.getContractFactory("GameMarket");
  // const gameMarket = await GameMarket.deploy(testnetUSDC, "FNC", "G2");

  // console.log("GameMarket deployed to:", await gameMarket.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
