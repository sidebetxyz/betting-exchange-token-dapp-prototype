// Get references to HTML elements
const connectButton = document.getElementById("connect-button");
const accountInfo = document.getElementById("account-info");
const networkInfo = document.getElementById("network-info");

const tokenAddress = "0x4f5d4a27625cd12c8582e0ea390542a787d5d8f2";
let tokenABI, tokenContract;
let provider, signer, account;

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
    provider = new ethers.BrowserProvider(window.ethereum);
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

    await loadContractInfo(signer); //

    console.log("END OF INIT");

    // Error out if initialization fails
  } catch (error) {
    console.error(error);
  }
}

// function to load ABI and initialize contract instance
async function loadContractInfo(connectedTo) {
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
  console.log("END OF CONTRACT INFO");
}

async function loadABI(filename) {
  try {
    const response = await fetch(`./abis/${filename}`);
    const json = await response.json();
    return json;
  } catch (error) {
    console.error(`Error loading ABI: ${filename}`, error);
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

// Attach listeners if wallet is detected and provide fallback provider if none is detected
if (typeof window.ethereum !== "undefined") {
  console.log("WALLET FOUND")
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
        provider = new ethers.BrowserProvider(window.ethereum);
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
    provider = new ethers.JsonRpcProvider('https://public-node.testnet.rsk.co/');
}

loadContractInfo(provider); // load contract info on page load with the read-only provider if MetaMask is not installed.

