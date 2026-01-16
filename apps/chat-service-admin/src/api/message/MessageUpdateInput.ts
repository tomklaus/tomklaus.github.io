import { UserWhereUniqueInput } from "../user/UserWhereUniqueInput";

export type MessageUpdateInput = {
  content?: string | null;
  sentAt?: Date | null;
  user?: UserWhereUniqueInput | null;
};
