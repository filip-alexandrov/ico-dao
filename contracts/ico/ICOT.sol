//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.10;

// @Alexandrov: Consider making the entry point upgradable
// @Alexandrov: Consider appropriate license
// @Alexandrov: Choosen sol version offers long-term support
// 18 decimals precisiion (is standard)

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

contract ICOT is ERC20, ERC20Permit, ERC20Votes {
    // The following functions are overrides required by Solidity.

    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override(ERC20, ERC20Votes) {
        super._afterTokenTransfer(from, to, amount);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20, ERC20Votes)
    {
        super._burn(account, amount);
    }

    // Implementation of minting functions
    address public owner;

    constructor(string memory name, string memory symbol) ERC20(name, symbol) ERC20Permit(name) {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    // Change owner of the contract
    function transferOwnership(address _newOwner) public onlyOwner {
        require(_newOwner != address(0), "New owner cannot be empty");
        require(
            _newOwner != owner,
            "New owner cannot be the same as the old one"
        );
        owner = _newOwner;
    }

    function mint(address _to, uint256 _amount) public onlyOwner {
        _mint(_to, _amount);
    }
}
