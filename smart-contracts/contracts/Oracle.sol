// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.12;

/// @title The Oracle contract used for settling the market and metadata
contract Oracle {
  /// @dev The admin of the contract
  address admin;
  /// @dev The team1 identifier
  string public team1;
  /// @dev The team2 identifier
  string public team2;
  /// @dev The winner team of the market
  string winner;
  /// @dev Whether the winner has been set
  bool isWinnerSet = false;

  /// EVENTS ///

  /// @dev Emitted when the winner is set
  event SetWinner(address sender, string winner);

  /// MODIFIERS ///

  /// @dev Only the admin can call this function
  modifier adminOnly() {
    require(admin == msg.sender, "Only the admin can call this function");
    _;
  }

  /// CONSTRUCTOR ///

  /// Creates a new oracle
  ///
  /// @param _team1 The team1 identifier
  /// @param _team2 The team2 identifier
  ///
  /// Requirements:
  /// - `_team1` cannot be empty
  /// - `_team2` cannot be empty
  /// - `_team1` and `_team2` cannot be the same
  constructor(string memory _team1, string memory _team2) {
    require(keccak256(abi.encodePacked(_team1)) != keccak256(abi.encodePacked("")), "Team 1 can't be empty");
    require(keccak256(abi.encodePacked(_team2)) != keccak256(abi.encodePacked("")), "Team 2 can't be empty");
    require(
      keccak256(abi.encodePacked(_team1)) != keccak256(abi.encodePacked(_team2)),
      "Team 1 and Team 2 can't be the same"
    );

    admin = msg.sender;
    team1 = _team1;
    team2 = _team2;
    isWinnerSet = false;
  }

  /// GETTERS ///

  /// Returns the winner of the market
  ///
  /// @return The winner of the market
  function getWinner() public view returns (string memory) {
    return winner;
  }

  /// Returns whether the winner has been set
  ///
  /// @return Whether the winner has been set
  function hasWinner() public view returns (bool) {
    return isWinnerSet;
  }

  /// SETTERS ///

  /// Sets the winner of the market
  ///
  /// @dev Can only be called by the admin
  /// @dev Can only be called once
  ///
  /// @param _team The team that won
  ///
  /// Requirements:
  /// - `_team` needs to be either `team1` or `team2`
  /// - The winner can only be set once
  function setWinner(string memory _team) public adminOnly {
    require(
      keccak256(abi.encodePacked(_team)) == keccak256(abi.encodePacked(team1)) ||
        keccak256(abi.encodePacked(_team)) == keccak256(abi.encodePacked(team2)),
      string.concat("Winner needs to be either ", team1, " or ", team2)
    );
    require(
      !isWinnerSet &&
        keccak256(abi.encodePacked(winner)) != keccak256(abi.encodePacked(team1)) &&
        keccak256(abi.encodePacked(winner)) != keccak256(abi.encodePacked(team2)),
      "Winner can only be set once"
    );

    winner = _team;
    isWinnerSet = true;
    emit SetWinner(msg.sender, _team);
  }
}
