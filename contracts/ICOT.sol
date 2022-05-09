//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

// @Alexandrov: Consider making the entry point upgradable
// @Alexandrov: Consider appropriate license
// @Alexandrov: Choosen sol version offers long-term support
// 18 decimals precisiion (is standard)


contract ICOT is ERC20 {
    address owner;

    constructor(
        string memory name,
        string memory symbol
    ) ERC20(name, symbol) {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
