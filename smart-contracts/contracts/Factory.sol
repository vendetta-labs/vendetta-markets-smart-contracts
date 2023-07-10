// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

import "./Market.sol";

/// @title The Factory contract used for creating and storing markets
contract Factory {
  /// @dev The admin of the contract
  address admin;
  /// @dev The list of created markets
  address[] public markets;

  /// EVENTS ///

  /// @dev Emitted when a new market is created
  event NewMarket(address sender, address market);

  /// MODIFIERS ///

  /// @dev Only the admin can call this function
  modifier adminOnly() {
    require(admin == msg.sender, "Only the admin can call this function");
    _;
  }

  /// CONSTRUCTOR ///

  /// Creates a new factory
  constructor() {
    admin = msg.sender;
  }

  /// ACTIONS ///

  /// Creates a new market
  ///
  /// @param _tokenAddress The address of the ERC20 token to use for betting
  /// @param _oracleAddress The address of the Oracle contract to use for settling the market and metadata
  /// @return The address of the created market
  function createMarket(address _tokenAddress, address _oracleAddress) public adminOnly returns (address) {
    Market market = new Market(_tokenAddress, _oracleAddress);

    markets.push(address(market));

    emit NewMarket(msg.sender, address(market));

    return address(market);
  }
}
