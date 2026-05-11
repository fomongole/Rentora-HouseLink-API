export enum AuditAction {
  CREATE          = 'CREATE',
  UPDATE          = 'UPDATE',
  DELETE          = 'DELETE',
  RESTORE         = 'RESTORE',
  STATUS_CHANGE   = 'STATUS_CHANGE',
  IMAGE_UPLOAD    = 'IMAGE_UPLOAD',
  IMAGE_DELETE    = 'IMAGE_DELETE',
  LOGIN           = 'LOGIN',
  LOGIN_FAILED    = 'LOGIN_FAILED',
  LOGOUT          = 'LOGOUT',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
}