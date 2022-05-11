//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";


// Dai is algorithmic stablecoin 
// considered to be one of the most secure

contract UST is ERC20, Ownable {
    constructor() ERC20("Terra", "UST") {}

    function mint(address to, uint256 amount) external onlyOwner() {
        _mint(to, amount);
    }
}