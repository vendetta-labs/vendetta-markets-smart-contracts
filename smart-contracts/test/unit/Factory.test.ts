import { expect } from "chai";
import { ethers } from "hardhat";
import { ZeroAddress } from "ethers";
import { Factory } from "../../typechain-types";
import { deployFakeToken } from "./Market.test";
import { deployOracle } from "./Oracle.test";

async function deployFactory(): Promise<Factory> {
  const Factory = await ethers.getContractFactory("Factory");
  const factory = await Factory.deploy();
  return factory;
}

describe("Factory", function () {
  it("should create the factory", async function () {
    const factory = await deployFactory();

    expect(await factory.getAddress()).to.not.equal(ZeroAddress);
  });

  it("should be able to create a new market", async function () {
    const factory = await deployFactory();
    const token = await deployFakeToken();
    const oracle = await deployOracle("FNC", "G2");

    await factory.createMarket(await token.getAddress(), await oracle.getAddress());

    const marketAddress = await factory.markets(0);
    expect(marketAddress).to.not.equal(ZeroAddress);

    const market = await ethers.getContractAt("Market", marketAddress);
    expect(await market.token()).to.equal(await token.getAddress());
    expect(await market.oracle()).to.equal(await oracle.getAddress());
  });

  it("throw an error when creating a market if the token address is zero address", async function () {
    const factory = await deployFactory();
    const oracle = await deployOracle("FNC", "G2");

    await expect(factory.createMarket(ZeroAddress, await oracle.getAddress())).to.be.revertedWith(
      "ERC20: cant be zero address"
    );
  });

  it("throw an error when creating a makert if the oracle address is zero address", async function () {
    const factory = await deployFactory();
    const token = await deployFakeToken();

    await expect(factory.createMarket(await token.getAddress(), ZeroAddress)).to.be.revertedWith(
      "Oracle: cant be zero address"
    );
  });

  it("throw an error when creating a market if not admin", async function () {
    const factory = await deployFactory();
    const token = await deployFakeToken();
    const oracle = await deployOracle("FNC", "G2");

    const notAdmin = await ethers.provider.getSigner(1);

    await expect(
      factory.connect(notAdmin).createMarket(await token.getAddress(), await oracle.getAddress())
    ).to.be.revertedWith("Only the admin can call this function");
  });
});
