import { registerEnumType } from '@nestjs/graphql';

export enum GuardianGroupType {
  DYNAMIC = 'DYNAMIC',
  FIXED = 'FIXED',
}

export enum GuardianGroupMembershipSource {
  DYNAMIC = 'DYNAMIC',
  FIXED = 'FIXED',
}

export enum GuardianGroupMembershipState {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  UNEVALUABLE = 'UNEVALUABLE',
}

registerEnumType(GuardianGroupType, { name: 'GuardianGroupType' });
registerEnumType(GuardianGroupMembershipSource, {
  name: 'GuardianGroupMembershipSource',
});
registerEnumType(GuardianGroupMembershipState, {
  name: 'GuardianGroupMembershipState',
});
