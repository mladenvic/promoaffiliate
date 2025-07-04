import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Affiliates } from './affiliates';

describe('Affiliates', () => {
  let component: Affiliates;
  let fixture: ComponentFixture<Affiliates>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Affiliates]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Affiliates);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
