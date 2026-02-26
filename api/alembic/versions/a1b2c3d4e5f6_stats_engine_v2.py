"""Stats engine v2 — new experiment config columns + experiment_results table

Revision ID: a1b2c3d4e5f6
Revises: 0de207ac6e82
Create Date: 2026-02-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '0de207ac6e82'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add 4 new config columns to experiments table
    op.add_column('experiments', sa.Column('loss_threshold', sa.Float(), nullable=False, server_default='0.005'))
    op.add_column('experiments', sa.Column('rope_width', sa.Float(), nullable=False, server_default='0.005'))
    op.add_column('experiments', sa.Column('expected_conversion_rate', sa.Float(), nullable=True))
    op.add_column('experiments', sa.Column('prior_confidence', sa.Float(), nullable=True))

    # Create experiment_results table for completed experiment snapshots
    op.create_table('experiment_results',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('experiment_id', sa.UUID(), nullable=False),
        sa.Column('project_id', sa.UUID(), nullable=False),
        sa.Column('variant_results', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('winning_variant', sa.String(length=255), nullable=True),
        sa.Column('overall_conversion_rate', sa.Float(), nullable=True),
        sa.Column('effect_size', sa.Float(), nullable=True),
        sa.Column('engagement_weights', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['experiment_id'], ['experiments.id']),
        sa.ForeignKeyConstraint(['project_id'], ['projects.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('experiment_id', name='uq_experiment_results_experiment_id'),
    )
    op.create_index(op.f('ix_experiment_results_project_id'), 'experiment_results', ['project_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_experiment_results_project_id'), table_name='experiment_results')
    op.drop_table('experiment_results')
    op.drop_column('experiments', 'prior_confidence')
    op.drop_column('experiments', 'expected_conversion_rate')
    op.drop_column('experiments', 'rope_width')
    op.drop_column('experiments', 'loss_threshold')
