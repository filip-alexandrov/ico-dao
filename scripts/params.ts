import { ethers } from "hardhat";

export const VOTING_DELAY = 2; // blocks delay before voting starts
export const VOTING_PERIOD = 5; // blocks voting duration
export const MIN_VOTES_TO_PROPOSE = ethers.BigNumber.from(10); // tokens
export const QUORUM_PERCENTAGE = 51; // min 50% have to vote
export const MIN_DELAY = 300; // secs to delay execution