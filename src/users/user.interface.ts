export interface UserMethods {
  comparePassword(password: string): Promise<boolean>;
  toJSON?(): any;
}
