import * as dotenv from "dotenv";
import { Contract, ContractTransaction, ethers } from "ethers";
import allo from "../abi/Allo.json";
import data from "../data/pool.data.json";

dotenv.config();

async function createPool() {
  const provider = new ethers.providers.JsonRpcProvider(
    process.env.INFURA_RPC_URL as string
  );

  const signer = new ethers.Wallet(
    process.env.SIGNER_PRIVATE_KEY as string,
    provider
  );

  const alloContract: Contract = new ethers.Contract(
    process.env.ALLO_MAIN_ADDRESS as string,
    allo.abi,
    signer
  );

  const startTime = data.allocationStartTime;
  const endTime = data.allocationEndTime;

  const encodedInitData = ethers.utils.defaultAbiCoder.encode(
    ["bool", "bool", "uint64", "uint64", "uint256"],
    [
      data.useRegistry,
      data.metadataRequires,
      startTime,
      endTime,
      data.maxVoiceCredits,
    ]
  );

  try {
    console.info("Creating pool...");

    const staticCallResult =
      await alloContract.callStatic.createPoolWithCustomStrategy(
        data.profileId,
        data.strategyAddress,
        encodedInitData,
        data.poolToken,
        data.poolAmount,
        [data.metadata.protocol, data.metadata.pointer],
        data.poolManagers
      );

    const createTx: ContractTransaction =
      await alloContract.createPoolWithCustomStrategy(
        data.profileId,
        data.strategyAddress,
        encodedInitData,
        data.poolToken,
        data.poolAmount,
        [data.metadata.protocol, data.metadata.pointer],
        data.poolManagers
      );
    await createTx.wait();

    console.log("✅ Pool created with id: ", staticCallResult.toString());
  } catch (error) {
    console.error(error);
  }
}

createPool().catch((error) => {
  console.error(error);
  process.exit(1);
});
