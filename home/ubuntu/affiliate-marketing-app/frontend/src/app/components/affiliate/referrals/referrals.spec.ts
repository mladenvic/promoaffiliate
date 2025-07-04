import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Referrals } from './referrals';

describe('Referrals', () => {
  let component: Referrals;
  let fixture: ComponentFixture<Referrals>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Referrals]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Referrals);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
