import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from "@ton/core";

export const CSBT_REGISTRY_OPCODES = {
  set_root: 0x73657472,
  change_admin: 0x63686761,
};

export const CSBT_REGISTRY_ERRORS = {
  unauthorized: 401,
  already_exists: 409,
  invalid_op: 403,
};

export interface CsbtRegistryConfig {
  adminAddress: Address;
  roots?: Cell | null;
}

export function csbtRegistryConfigToCell(config: CsbtRegistryConfig): Cell {
  return beginCell()
    .storeAddress(config.adminAddress)
    .storeDict(config.roots || null)
    .endCell();
}

export class CsbtRegistry implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new CsbtRegistry(address);
  }

  static createFromConfig(config: CsbtRegistryConfig, code: Cell, workchain = 0) {
    const data = csbtRegistryConfigToCell(config);
    const init = { code, data };
    return new CsbtRegistry(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  async sendSetRoot(
    provider: ContractProvider,
    via: Sender,
    opts: {
      eventHash: bigint;
      root: bigint;
      queryId?: bigint;
      value: bigint;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(CSBT_REGISTRY_OPCODES.set_root, 32)
        .storeUint(opts.queryId || 0n, 64)
        .storeUint(opts.eventHash, 256)
        .storeUint(opts.root, 256)
        .endCell(),
    });
  }

  async sendChangeAdmin(
    provider: ContractProvider,
    via: Sender,
    opts: {
      newAdmin: Address;
      queryId?: bigint;
      value: bigint;
    }
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(CSBT_REGISTRY_OPCODES.change_admin, 32)
        .storeUint(opts.queryId || 0n, 64)
        .storeAddress(opts.newAdmin)
        .endCell(),
    });
  }

  async getRoot(provider: ContractProvider, eventHash: bigint): Promise<bigint> {
    const result = await provider.get("get_root", [
      { type: "int", value: eventHash },
    ]);
    return result.stack.readBigNumber();
  }

  async getRootOpt(provider: ContractProvider, eventHash: bigint): Promise<{ root: bigint; found: boolean }> {
    const result = await provider.get("get_root_opt", [
      { type: "int", value: eventHash },
    ]);
    const root = result.stack.readBigNumber();
    const found = result.stack.readBoolean();
    return { root, found };
  }

  async getAdmin(provider: ContractProvider): Promise<Address> {
    const result = await provider.get("get_admin", []);
    return result.stack.readAddress();
  }
}
