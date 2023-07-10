// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./ERC20/ERC20.sol";

contract FakeToken is ERC20 {
  constructor(uint256 initialSupply) ERC20("Vendetta Chip", "VCHIP") {
    _mint(msg.sender, initialSupply);
  }
}
