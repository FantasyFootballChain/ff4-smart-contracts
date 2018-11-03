pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

import "./FantasyFootballChain.sol";

/**
 * @title TicketSystem
 * @dev Smart contract for support tickets
 */
contract TicketSystem is Ownable {

    using SafeMath for uint;

    FantasyFootballChain public ff4;

    mapping(uint => Ticket) public tickets;    
    uint public ticketsCount;

    mapping(address => bool) public adminActive;
    address[] public admins;

    enum TicketState { Uninitialized, Open, Closed }

    struct Ticket {
        uint createdAt;
        uint closedAt;
        uint lastUpdatedAt;
        uint messagesCount;
        TicketState state;
        address userAddress;
        string[] messages;
        address[] authors;
    }

    //==========
    // Modifiers
    //==========

    /**
     * @dev Modifier checks that action can be called only by admin
     */
    modifier onlyAdmin() {
        require(adminActive[msg.sender]);
        _;
    }

    /**
     * @dev Modifier checks that ticket exists
     */
    modifier validTicketIndex(uint _ticketIndex) {
        // ticket should exist or it should be the 1st ticket
        require(_ticketIndex < ticketsCount || ticketsCount == 0);
        _;
    }

    /**
     * @dev Constructor
     * @param _fantasyFootballChainAddress fantasy football chain address
     */
    constructor(address _fantasyFootballChainAddress) public {
        // validation
        require(_fantasyFootballChainAddress != address(0));
        // setting contract properties
        ff4 = FantasyFootballChain(_fantasyFootballChainAddress);
    }

    //==============
    // Owner methods
    //==============

    /**
     * @dev Adds admin address who can answer tickets
     * @param _adminAddress admin address to be added
     */
    function addAdmin(address _adminAddress) external onlyOwner {
        require(_adminAddress != address(0));
        adminActive[_adminAddress] = true;
        admins.push(_adminAddress);
    }

    /**
     * @dev Removes admin
     * @param _adminAddress admin address to be deleted
     */
    function removeAdmin(address _adminAddress) external onlyOwner {
        require(_adminAddress != address(0));
        // disable admin and remove his address
        adminActive[_adminAddress] = false;
        for(uint i = 0; i < admins.length; i++) {
            if(admins[i] == _adminAddress) {
                delete admins[i];
                break;
            }
        }
    }

    //==============
    // Admin methods
    //==============

    /**
     * @dev Closes ticket by admin
     * @param _ticketIndex ticket id
     */
    function closeTicket(uint _ticketIndex) external validTicketIndex(_ticketIndex) onlyAdmin {
        tickets[_ticketIndex].state = TicketState.Closed;
        tickets[_ticketIndex].lastUpdatedAt = now;
    }

    /**
     * @dev Replies to ticket by admin
     * @param _ticketIndex ticket id
     * @param _message text of the reply
     */
    function replyToTicketByAdmin(uint _ticketIndex, string _message) external validTicketIndex(_ticketIndex) onlyAdmin {
        _writeMessageToTicket(_ticketIndex, msg.sender, _message);
    }

    //=============
    // User methods
    //=============

    /**
     * @dev Creates a new ticket(question) by user
     * @param _squadIndex squad id
     * @param _message text of the question
     */
    function createTicket(uint _squadIndex, string _message) external {
        // validation
        (,,,address userAddress,,) = ff4.getSquadSystemInfo(_squadIndex);
        require(userAddress == msg.sender);
        // create and save ticket
        Ticket memory ticket;
        ticket.createdAt = now;
        ticket.state = TicketState.Open;
        ticket.userAddress = msg.sender;
        tickets[ticketsCount] = ticket;
        // write message to ticket
        _writeMessageToTicket(ticketsCount, msg.sender, _message);
        // update global tickets count
        ticketsCount = ticketsCount.add(1);
    }

    /**
     * @dev Returns author and message from ticket
     * @param _ticketIndex ticket index
     * @param _messageIndex message index
     * @return author address and message
     */
    function getTicketMessage(uint _ticketIndex, uint _messageIndex) external view validTicketIndex(_ticketIndex) returns(address, string) {
        // validation
        require(_messageIndex < tickets[_ticketIndex].messagesCount);
        // return author address and message
        return (
            tickets[_ticketIndex].authors[_messageIndex],
            tickets[_ticketIndex].messages[_messageIndex]
        );
    }

    /**
     * @dev Replies to existing ticket by user
     * @param _ticketIndex ticket id
     * @param _message text of the reply
     */
    function replyToTicketByUser(uint _ticketIndex, string _message) external validTicketIndex(_ticketIndex) {
        // validation
        require(tickets[_ticketIndex].userAddress == msg.sender);
        // reply to ticket
        _writeMessageToTicket(_ticketIndex, msg.sender, _message);
    }

    //========
    // Helpers
    //========

    /**
     * @dev Writes message to existing ticket
     * @param _ticketIndex ticket id
     * @param _author author address
     * @param _message ticket message
     */
    function _writeMessageToTicket(uint _ticketIndex, address _author, string _message) internal validTicketIndex(_ticketIndex) {
        // validation
        require(_author != address(0));
        // save message
        tickets[_ticketIndex].messages.push(_message);
        tickets[_ticketIndex].authors.push(_author);
        tickets[_ticketIndex].messagesCount = tickets[_ticketIndex].messagesCount.add(1);
        tickets[_ticketIndex].lastUpdatedAt = now;
    }

}
