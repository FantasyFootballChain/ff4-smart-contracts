pragma solidity ^0.4.24;

import "./FantasyFootballChain.sol";
import "./TicketSystem.sol";

contract TicketSystemTestable is TicketSystem {

    constructor(address _fantasyFootballChainAddress) public TicketSystem(_fantasyFootballChainAddress) {}

    function writeMessageToTicket(uint _ticketIndex, address _author, string _message) external validTicketIndex(_ticketIndex) {
        _writeMessageToTicket(_ticketIndex, _author, _message);
    }

}
