import { describe,it,expect,vi } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Request,Response,NextFunction } from 'express';
import { auth } from '../shared/http.js';
import { config } from '../shared/config.js';
function check(token?:string){const req={headers:{authorization:token?`Bearer ${token}`:undefined}} as Request;const res={locals:{}} as Response;const next=vi.fn();auth(req,res,next as NextFunction);return {res,next};}
const issue=(payload:object,options:jwt.SignOptions={})=>jwt.sign(payload,config.JWT_ACCESS_SECRET,{subject:'user-1',issuer:'railflow',audience:'railflow-api',expiresIn:'15m',...options});
describe('access token validation',()=>{
 it('sets identity only from a verified access token',()=>{const {res,next}=check(issue({kind:'access'}));expect(res.locals.userId).toBe('user-1');expect(next).toHaveBeenCalledWith();});
 it.each([undefined,'not-a-jwt',issue({kind:'refresh'}),issue({kind:'access'},{expiresIn:-1}),issue({kind:'access'},{audience:'other-api'})])('rejects missing, malformed, wrong-kind, expired and wrong-audience tokens',token=>{const {res,next}=check(token);expect(res.locals.userId).toBeUndefined();expect(next.mock.calls[0]![0].status).toBe(401);});
});
