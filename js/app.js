// Get references to HTML elements
const connectButton = document.getElementById("connect-button");
const accountInfo = document.getElementById("account-info");
const networkInfo = document.getElementById("network-info");
const form = document.getElementById("bet-form");

const tokenAddress = "0x9828a5ae9b83a56d20576bf8a53bed6259b731c1";
const DEFAULT_ORACLE_ADDRESS = "0x0000000000000000000000000000000000000000";

let tokenABI, tokenContract;
let provider, signer, account;
let betIds = [];

// Attach click event listener to the connect button
connectButton.addEventListener("click", connectToWallet);

// Asynchronously connect to wallet when the connect button is clicked
async function connectToWallet() {
  // Check if the browser has Ethereum provider injected
  if (typeof window.ethereum === "undefined") {
    console.log("Wallet is not installed!");
    return;
  }

  try {
    // Create an ethers.js provider instance
    provider = null;
    console.log(provider);

    provider = await new ethers.BrowserProvider(window.ethereum);
    console.log("P2", provider);

    // Get the signer from the provider
    signer = await provider.getSigner();
    // Get the connected account address from the signer
    account = await signer.getAddress();

    // If no account is connected, log a message to the console
    if (!account) {
      console.log("Please connect to Wallet.");
      return;
    }

    // Handle the connected account
    handleAccountsChanged(account.toLowerCase());

    // Get the network chainId and handle it
    const chainId = await provider
      .getNetwork()
      .then((network) => network.chainId);
    if (chainId != null) {
      handleChainChanged(Number(chainId));
    } else {
      console.log("Connected, but chainId is null!");
    }

    tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer);
    await loadContractInfo(signer); //

    console.log("END OF INIT");
    console.log(provider);

    // Error out if initialization fails
  } catch (error) {
    console.error(error);
  }
}

// Function to load ABI and initialize contract instance
async function loadContractInfo(connectedTo) {
  console.log(provider);

  if (!tokenABI) {
    tokenABI = await loadABI("TestingBettingExchangeToken.json");
  }

  if (!tokenContract) {
    tokenContract = new ethers.Contract(tokenAddress, tokenABI, connectedTo);
  }

  try {
    const tokenSymbol = await tokenContract.symbol();
    console.log("Token Symbol:", tokenSymbol);
  } catch (error) {
    console.error("Error fetching token symbol:", error);
  }

  try {
    const tokenDecimals = await tokenContract.decimals();
    console.log("Token Decimals:", tokenDecimals);
  } catch (error) {
    console.error("Error fetching token decimals:", error);
  }

  try {
    const bets = await fetchAvailableBets();
    betIds = [];
    for (let i = 0; i < bets.length; i++) {
      betIds.push(Number(bets[i]));
    }
    console.log("AVAILABLE BETS:", betIds);
  } catch (error) {
    console.error("Error fetching available bets:", error);
  }

  try {
    await populateAvailableBets();
  } catch {
    console.error("Error populating availiable bets:", error);
  }

  try {
    await populateUserBalance();
  } catch {
    console.error("Error populating BET balance:", error);
  }

  try {
    await populateUserMyActiveBetsPanel();
    console.log("FIN POP ACTIVE BETS");
  } catch {
    console.error("Error populating user bets:", error);
  }

  try {
    await populateUserOpenBetsControlPanel();
    console.log("FIN POP USER BETS");
  } catch {
    console.error("Error populating user bets:", error);
  }

  console.log("END OF CONTRACT INFO");
}

async function fetchAvailableBets() {
  const bets = await tokenContract.getAvailableBets();
  return bets;
}

async function populateAvailableBets() {
  const betsContainer = document.getElementById("available-bets");
  betsContainer.innerHTML = "";

  // Create a table
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Bet ID", "Amount", "Alice", "Oracle"].forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  betsContainer.appendChild(table);

  try {
    const betsDetails = await Promise.all(
      betIds.map((betId) => tokenContract.readBet(betId))
    );

    if (betsDetails.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.textContent = "No available bets at the moment.";
      cell.colSpan = 4;
      row.appendChild(cell);
      tbody.appendChild(row);
      return;
    }

    betsDetails.forEach((betDetail, index) => {
      const { alice, amount, oracle } = betDetail;
      const truncatedAlice = truncateAddress(alice);
      const formattedAmount = formatWeiToEther(amount);
      const truncatedOracle = truncateAddress(oracle);

      const row = document.createElement("tr");
      const id = betIds[index];

      // Adjusting the order of data
      [id, formattedAmount, truncatedAlice, truncatedOracle].forEach((data) => {
        const td = document.createElement("td");
        td.textContent = data;
        row.appendChild(td);
      });

      tbody.appendChild(row);
    });
  } catch (error) {
    console.error("Error fetching bet details:", error);
    betsContainer.innerHTML = "<div>Error fetching available bets.</div>";
  }
}

async function populateUserBalance() {
  if (account && tokenContract) {
    // Check if account is defined and tokenContract is initialized
    try {
      const balance = await tokenContract.balanceOf(account);
      const balanceElement = document.getElementById("bet-balance");
      console.log(balance);
      balanceElement.textContent = `Balance: ${ethers.formatUnits(
        balance,
        "ether"
      )} BET`;
    } catch (error) {
      console.error("Error updating user balance:", error);
    }
  } else {
    // You may want to update the balance displayed to '0' or some placeholder when no account is connected.
    const balanceElement = document.getElementById("bet-balance");
    balanceElement.textContent = `Connect Wallet to view Balance`;
  }
}

async function populateUserOpenBetsControlPanel() {
  console.log("PANEL BETS");

  const userBetsContainer = document.getElementById("user-bets");
  userBetsContainer.innerHTML = "";

  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");

  // Modify headers
  ["Bet ID", "Amount", "Oracle", "Actions"].forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });

  thead.appendChild(headerRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  userBetsContainer.appendChild(table);

  if (account) {
    try {
      const userBets = await tokenContract.getOpenBetsForUser(account);
      console.log("OPEN BETS", userBets);

      if (userBets.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "You have no bets.";
        cell.colSpan = 4;
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
      }

      userBets.forEach(async (betId) => {
        const betDetail = await tokenContract.readBet(betId);

        const { alice, amount, oracle } = betDetail;
        const formattedAmount = formatWeiToEther(amount);
        const truncatedOracle = truncateAddress(oracle);

        const row = document.createElement("tr");

        // Create cells and append in desired order
        const idCell = document.createElement("td");
        idCell.textContent = betId;
        row.appendChild(idCell);

        const amountCell = document.createElement("td");
        amountCell.textContent = formattedAmount;
        row.appendChild(amountCell);

        const oracleCell = document.createElement("td");
        oracleCell.textContent = truncatedOracle;
        row.appendChild(oracleCell);

        const actionCell = document.createElement("td");

        const updateButton = document.createElement("button");
        updateButton.textContent = "Update Oracle";
        updateButton.dataset.action = "updateOracle";
        updateButton.dataset.betId = betId;
        updateButton.addEventListener("click", async () => {
          const newOracleAddress = prompt("Enter the new oracle address:");
          if (!newOracleAddress) return;
          try {
            await tokenContract.updateBetOracle(betId, newOracleAddress);
            console.log(
              `Oracle for bet ${betId} updated to ${newOracleAddress} successfully.`
            );
          } catch (error) {
            console.error(`Error updating oracle for bet ${betId}:`, error);
          }
        });
        actionCell.appendChild(updateButton);

        const cancelButton = document.createElement("button");
        cancelButton.textContent = "Cancel";
        cancelButton.dataset.action = "cancelBet";
        cancelButton.dataset.betId = betId;
        cancelButton.addEventListener("click", async () => {
          const confirmCancel = confirm(
            `Are you sure you want to cancel bet ${betId}?`
          );
          if (!confirmCancel) return;
          try {
            await tokenContract.cancelBet(betId);
            console.log(`Bet ${betId} canceled successfully.`);
          } catch (error) {
            console.error(`Error canceling bet ${betId}:`, error);
          }
        });
        actionCell.appendChild(cancelButton);

        row.appendChild(actionCell);

        tbody.appendChild(row);
      });
    } catch (error) {
      console.error("Error fetching user bets details:", error);
      userBetsContainer.innerHTML = "<div>Error fetching user bets.</div>";
    }
  } else {
    userBetsContainer.innerHTML =
      "<div>Connect wallet to view your bets.</div>";
  }
}

async function populateUserMyActiveBetsPanel() {
  const activeBetsContainer = document.getElementById("active-bets");

  // Clear any previous active bets
  activeBetsContainer.innerHTML = "";

  // Create a table
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const headerRow = document.createElement("tr");
  ["Bet ID", "Alice", "Amount"].forEach((header) => {
    const th = document.createElement("th");
    th.textContent = header;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  const tbody = document.createElement("tbody");
  table.appendChild(tbody);
  activeBetsContainer.appendChild(table);

  if (account) {
    try {
      const activeBets = await tokenContract.getActiveBetsForUser(account);

      if (activeBets.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");
        cell.textContent = "You have no active bets.";
        cell.colSpan = 3;
        row.appendChild(cell);
        tbody.appendChild(row);
        return;
      }

      activeBets.forEach(async (betId) => {
        const betDetail = await tokenContract.readBet(betId);
        const { alice, amount } = betDetail;
        const truncatedAlice = truncateAddress(alice);
        const formattedAmount = formatWeiToEther(amount);

        const row = document.createElement("tr");

        // Add cells to the row
        [betId, truncatedAlice, formattedAmount].forEach((data) => {
          const td = document.createElement("td");
          td.textContent = data;
          row.appendChild(td);
        });

        tbody.appendChild(row);
      });
    } catch (error) {
      console.error("Error fetching active bets details:", error);
      activeBetsContainer.innerHTML = "<div>Error fetching active bets.</div>";
    }
  } else {
    activeBetsContainer.innerHTML =
      "<div>Connect wallet to view your active bets.</div>";
  }
}

async function createBet(betAmount, oracleAddress) {
  try {
    // Convert betAmount to wei or the smallest denomination of your token
    const amount = ethers.parseUnits(betAmount, "ether"); // or 'wei' if the amount is in wei
    console.log(amount);
    console.log(tokenContract);

    // Assuming your smart contract has a function named `createBet` that takes betAmount and oracleAddress as parameters
    // Adjust accordingly to match your smart contract function's name and parameters
    const tx = await tokenContract.createBet(amount, oracleAddress);

    // Wait for transaction confirmation
    const receipt = await tx.wait();

    // Log the transaction receipt
    console.log("Transaction Receipt:", receipt);

    await loadContractInfo(signer);

    // Optionally, update UI elements here to reflect the creation of the new bet
  } catch (error) {
    console.error("Error creating bet:", error);
    // Handle the error appropriately in your UI
  }
}

async function loadABI(filename) {
  try {
    const response = await fetch(`./abis/${filename}`);
    if (!response.ok) {
      throw Error(`HTTP error! status: ${response.status}`);
    }
    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`Error loading ABI: ${filename}`, error);
    throw error; // rethrowing the error after logging it, so it can be handled by the caller if needed
  }
}

// Function to handle changes in connected accounts
function handleAccountsChanged(account) {
  // If no account is connected, update the accountInfo text content
  if (!account) {
    console.log("Please connect to Wallet.");
    accountInfo.textContent = "Not connected";
    return;
  }

  // Log connected account and update the accountInfo text content
  console.log("Connected Account:", account);
  const checksumAddress = ethers.getAddress(account);
  console.log("Checksumed Address:", checksumAddress);
  accountInfo.textContent = `Connected: ${checksumAddress}`;
}

// Function to handle changes in the network chainId
function handleChainChanged(chainId) {
  // Log the changed chainId and update the networkInfo text content
  console.log("Chain changed to:", chainId);
  networkInfo.textContent = `Network: ${getNetworkName(chainId)}`;
}

// Function to get the name of the network based on the chainId
function getNetworkName(chainId) {
  // Return the corresponding network name for the given chainId
  switch (chainId) {
    case 1:
      return "Ethereum Mainnet";
    case 31:
      return "RSK Testnet";
    default:
      return "Unknown Network";
  }
}

// Function to truncate an address
function truncateAddress(address) {
  return address.length > 13
    ? address.substring(0, 6) + "..." + address.substring(address.length - 4)
    : address;
}

function formatWeiToEther(wei) {
  return ethers.formatEther(wei);
}

// Attach listeners if wallet is detected and provide fallback provider if none is detected
if (typeof window.ethereum !== "undefined") {
  console.log("WALLET FOUND");
  provider = new ethers.BrowserProvider(window.ethereum);
  // Listener for changes in the connected account
  window.ethereum.on("accountsChanged", async function (accounts) {
    if (accounts.length === 0) {
      console.log("Please connect to Wallet.");
      accountInfo.textContent = "Not connected";
      tokenContract = null; // clear the contract instance as no account is connected
    } else {
      handleAccountsChanged(accounts[0]);
      try {
        console.log(provider);
        provider = new ethers.BrowserProvider(window.ethereum);
        console.log(provider);

        signer = await provider.getSigner(); // get the new signer
        tokenContract = new ethers.Contract(tokenAddress, tokenABI, signer); // create a new contract instance with the new signer
        loadContractInfo(signer);
      } catch (error) {
        console.error(
          "Error creating a new contract instance with the new signer:",
          error
        );
      }
    }
  });

  // Listener for changes in the connected network
  window.ethereum.on("chainChanged", function (chainId) {
    console.log(chainId);
    const decimalChainId = parseInt(chainId, 16);
    handleChainChanged(decimalChainId);
  });
} else {
  console.log("NO WALLET FOUND");
  provider = new ethers.JsonRpcProvider("https://public-node.testnet.rsk.co/");
}

// Create Bet form event listener
form.addEventListener("submit", async function (e) {
  e.preventDefault(); // prevents the default form submission behavior

  const betAmount = document.getElementById("bet-amount").value;
  let oracleAddress = document.getElementById("oracle-address").value || null; // or a default address if needed

  if (!oracleAddress) {
    oracleAddress = DEFAULT_ORACLE_ADDRESS; // if oracleAddress is blank, set it to the default oracle address
  }

  // Call the function to interact with the smart contract
  await createBet(betAmount, oracleAddress);
});

loadContractInfo(provider); // load contract info on page load with the read-only provider if MetaMask is not installed.
