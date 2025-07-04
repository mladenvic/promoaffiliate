import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Apply } from './apply';

describe('Apply', () => {
  let component: Apply;
  let fixture: ComponentFixture<Apply>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Apply]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Apply);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
