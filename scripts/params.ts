import { ethers } from "hardhat";

export const VOTING_DELAY = 2; // blocks delay before voting starts
export const VOTING_PERIOD = 5; // blocks voting duration
export const MIN_VOTES_TO_PROPOSE = ethers.utils.parseEther("10"); // tokens
export const QUORUM_PERCENTAGE = 51; // min 50% have to vote
export const MIN_DELAY = 300; // secs to delay execution

export const ICOT_NAME = "ICO Token"; // full name of the token
export const ICOT_SYMBOL = "ICOT"; // ticker of the token

export const immediateTransferRateBig = ethers.utils.parseEther("0.2"); // 20% goes directly to owner of ICO Manager
