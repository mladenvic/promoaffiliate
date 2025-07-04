import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { affiliateGuard } from './affiliate-guard';

describe('affiliateGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) => 
      TestBed.runInInjectionContext(() => affiliateGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
